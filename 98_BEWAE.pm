package main;
use warnings;
use strict;
use JSON;
use JSON::XS;
use POSIX;
use Time::HiRes qw(gettimeofday);

sub BEWAE_Initialize($$);
sub BEWAE_updateReading($$);
sub BEWAE_getDevice($$);
sub BEWAE_detailFn($$$$);
sub BEWAE_Set();
sub BEWAE_Define($$);
sub BEWAE_Undef($$);
#####################################
sub
BEWAE_getDevice($$) {
    my ($hash, $identifier) = @_;
    Log 2, "get device for $identifier";
    my $saved = $hash->{READINGS}{".$identifier"}{VAL};
    Log 2, "saved is '$saved'";
    return decode_json( $saved );
}

sub
BEWAE_getDeliberateDisabledDevices($) {
    my ($hash) = @_;

    my $disabled = $hash->{READINGS}{"deliberateDisabled"}{VAL};
    Log 2, "disabled is $disabled";

    return map { $_ => 1 } (split / /, $disabled);
}

sub
BEWAE_updateDeliberateDisabledReading($$$) {
    my ($hash, $identifier, $value) = @_;
    my %disabledSet = BEWAE_getDeliberateDisabledDevices( $hash );

    Log 2, "enabled: $value->{enabled}";
    if ($value->{enabled} =~ "yes") {
        Log 2, "enabled=yes";
        delete $disabledSet{$identifier};
    } else {
        $disabledSet{$identifier} = 1;
    }
    my @keys = (keys %disabledSet);
    Log 2, "keys is @keys";
    my $result = (join " ", @keys);
    Log 2, "deliberately disabled: $result";
    readingsSingleUpdate( $hash, "deliberateDisabled", $result, 0 );
}

sub
BEWAE_saveDevice($$$) {
    my ($hash, $identifier, $value) = @_;
    my $json = JSON->new;

    Log 2, "get device for $identifier";
    my $encoded = $json->encode( $value );
    readingsSingleUpdate( $hash, ".$identifier", $encoded, 0 );
    BEWAE_updateReading( $hash, $value );
}

sub
BEWAE_Initialize($$) {
    my ($hash) = @_;

    $hash->{SetFn} = "BEWAE_Set";
    $hash->{DefFn} = "BEWAE_Define";
    $hash->{UndefFn} = "BEWAE_Undef";
    $hash->{FW_detailFn} = "BEWAE_detailFn";
}

sub
BEWAE_detailFn($$$$) {
    my ($FW_wname, $d, $room, $pageHash) = @_;
    my $hash = $defs{$d};
    my $name = $hash->{NAME};
    return "<div><div id=\"BEWAE\"/></div>"
        ."<script>\$.getScript('fhem/BEWAE/bewae.js', function() { bewaesserung_load_complete(\"$name\");});"
        ."\$('<link>').appendTo('head').attr({type : 'text/css', rel : 'stylesheet'}).attr('href', 'fhem/BEWAE/bewae.css');"
        ."</script></div>";
}

sub BEWAE_getDevices($) {
    my (%hash) = @_;

    my $key;
    my $value;
    my @result = ();
    return @result if $hash{READINGS} == undef;

    my %readings = $hash{READINGS};
    while ( ($key, $value) = each %readings ) {
        if ($key =~ /\..*/) {
            Log 2, "add $key";
            $key =~ s/\.//g;
            push ( @result, "$key" );
        }
    }
    return @result;
}

sub
BEWAE_Set {
    my (%hash, @a) = @_;
    my $name = shift @a;
    my $modifier = shift @a;

    if ($modifier eq "modify") {
        Log 2, join( " ", @a );
        my $params = decode_json( join( " ", @a ) );

        my $identifier = $params->{identifier};
        my $deviceName = $params->{deviceName};
        my $weekdays = $params->{weekDays};
        my $switchTime = $params->{switchTime};
        my $duration = $params->{duration};
        my $delay = $params->{delay};
        my $before = $params->{before};
        my $after = $params->{after};

        $delay = 0 if not defined $delay;

        return "cannot find $deviceName, typo?" if not exists( $defs{$deviceName} );
        return "must specify identifier" if not defined $identifier;
        return "must specify deviceName" if not defined $deviceName;
        return "must specify weekdays" if not defined $weekdays;
        return "must specify switchTime" if not defined $switchTime;
        return "must specify duration" if not defined $duration;

        my $device = { };
        my $timerName = "${name}_${identifier}_timer";

        $device->{identifier} = $identifier;
        $device->{weekdays} = $weekdays;
        $device->{switchTime} = $switchTime;
        $device->{duration} = $duration;
        $device->{timerName} = $timerName;
        $device->{deviceName} = $deviceName;
        $device->{enabled} = "yes";
        $device->{before} = $before;
        $device->{after} = $after;
        $device->{delay} = $delay;
        BEWAE_saveDevice( %hash, $identifier, $device );

        fhem "delete $timerName";

        my $command = $before.";;";
        $command = $command."sleep($delay);;" if $delay > 0;
        $command .= "fhem(\"set \$NAME on-for-timer \$EVENT\");;$after";
        fhem "define $timerName WeekdayTimer $deviceName ${weekdays}|${switchTime}|${duration} {$command}";
        fhem "attr $timerName room hidden";
        return "modified $identifier in $name";
    }

    if ($modifier eq "on" || $modifier eq "off") {
        my $target = "disable";
        my $targetState = "no";
        $target = "enable" if $modifier eq "on";
        $targetState = "yes" if $modifier eq "on";

        my @devices = BEWAE_getDevices( %hash );
        my %deliberateDisabled = BEWAE_getDeliberateDisabledDevices(%hash);
        foreach(@devices) {
            my %device = BEWAE_getDevice( %hash, $_ );
            if ($deliberateDisabled{$device{identifier}} == undef) {
                $device{enabled} = $targetState;
                fhem "set $device{timerName} $target";
                BEWAE_saveDevice( %hash, $_, %device );
            }
        }
        $hash{STATE} = $modifier;
        return "ok in $name";
    }
    if (int( @a ) == 1) {
        my $switchHash = BEWAE_getDevice( %hash, $modifier );
        my $identifier = $modifier;
        return "cannot find device $identifier" if not defined $switchHash;
        return "invalid command, must add task" if int( @a ) != 1;

        my $task = shift @a;
        if ($task eq "delete") {
            fhem "delete $switchHash->{timerName}";
            fhem "deletereading $name $identifier";
            fhem "deletereading $name .$identifier";
            return "removed $identifier in $name";
        }
        if ($task eq "enable") {
            fhem "set $switchHash->{timerName} enable";
            $switchHash->{enabled} = "yes";
            BEWAE_saveDevice( %hash, $identifier, $switchHash );
            BEWAE_updateDeliberateDisabledReading( %hash, $identifier, $switchHash );
            return "enabled $identifier in $name";
        }
        if ($task eq "disable") {
            fhem "set $switchHash->{timerName} disable";
            $switchHash->{enabled} = "no";
            BEWAE_saveDevice( %hash, $identifier, $switchHash );
            BEWAE_updateDeliberateDisabledReading( %hash, $identifier, $switchHash );
            return "disabled $identifier in $name";
        }
    }

    my $states = "enable,disable,delete";
    my @deviceSpecific = ();

    my @devices = BEWAE_getDevices( %hash );
    foreach(@devices) {
        push ( @deviceSpecific, "$_:$states" );
    }
    my $deviceSpecificSetList = join( " ", @deviceSpecific );
    Log 2, $deviceSpecificSetList;
    return "unknown set value, choose one of on off modify $deviceSpecificSetList";
}

sub
BEWAE_updateReading($$) {
    my ($hash, $device) = @_;

    my $identifier = $device->{identifier};
    my $weekdays = $device->{weekdays};
    my $switchTime = $device->{switchTime};
    my $duration = $device->{duration};
    my $enabled = $device->{enabled};
    my $deviceName = $device->{deviceName};

    $identifier = $deviceName if $identifier == undef;

    my $state = "${deviceName} ${weekdays} ${switchTime} ${duration}";
    if ($enabled eq "no") {
        $state = "$state disabled";
    }
    readingsSingleUpdate( $hash, $identifier, $state, 0 );
    return undef;
}

sub
BEWAE_Define($$) {
    my ($hash, $def) = @_;
    $hash->{STATE} = "on";
    return undef;
}

sub
BEWAE_Undef($$)
{
    my ($hash, $arg) = @_;

    my @devices = BEWAE_getDevices( $hash );
    foreach(@devices) {
        Log 2, "delete $_";
        my $device = BEWAE_getDevice( $hash, $_ );
        fhem "delete $device->{timerDevice}";
    }
    return undef;
}

1;
