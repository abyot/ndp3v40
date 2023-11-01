/* global angular, dhis2, ndpFramework */

'use strict';

//Controller for settings page
ndpFramework.controller('HomeController',
        function($scope,
                $modal,
                $translate,
                $filter,
                SessionStorageService,
                SelectedMenuService,
                NotificationService,
                NDPMenuService,
                MetaDataFactory) {

    $scope.model = {
        metaDataCached: false,
        dataElementGroups: [],
        dataElementGroupSets: [],
        dataElementGroup: [],
        optionSets: [],
        optionSetsById: [],
        selectedNDP: null,
        ndp: null,
        slides: []
    };

    var start = new Date();
    dhis2.ndp.downloadMetaData().then(function(){
        var end = new Date();
        SessionStorageService.set('METADATA_CACHED', true);
        console.log('Finished loading metadata in about ', Math.floor((end - start) / 1000), ' - secs');

        MetaDataFactory.getAll('optionSets').then(function(optionSets){

            $scope.model.ndp = $filter('getFirst')(optionSets, {code: 'ndp'});

            if( !$scope.model.ndp || !$scope.model.ndp.code || !$scope.model.ndp.options || $scope.model.ndp.options.length < 1 ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_ndp_configuration"));
                return;
            }

            var currentNDP = $filter('filter')($scope.model.ndp.options, {isCurrentNDP: true});
            if ( currentNDP && currentNDP.length && currentNDP.length === 1 ){
                $scope.model.selectedNDP = currentNDP[0];
            }
            else{
                 $scope.model.selectedNDP = $scope.model.ndp.options[0];
            }

            $scope.model.metaDataCached = true;

            for( var i=1; i<=12; i++ ){
                $scope.model.slides.push({
                    id: i,
                    type: 'IMG',
                    path: 'images/NDPIII/' + i + '.jpeg',
                    style: 'background-image:url(images/NDPIII/' + i + '.jpeg)'
                });
            }

            NDPMenuService.getMenu().then(function(menu){
                $scope.model.menuItems = [
                    {
                        id: 'navigation',
                        order: 0,
                        displayName: $translate.instant('navigation'),
                        root: true,
                        show: true,
                        children: menu
                    }
                ];
            });
        });
    });

    $scope.$watch('model.selectedNDP', function(){
        $scope.model.selectedMenu = null;
    });

    $scope.setSelectedMenu = function( menu ){

        if ( menu.address ){
            window.location.href = menu.address;
        }
        else{
            if ( !menu.hasNoNDP && !$scope.model.selectedNDP ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("please_selected_ndp"));
                return;
            }

            if( $scope.model.selectedMenu && $scope.model.selectedMenu.id === menu.id ){
                $scope.model.selectedMenu = null;
            }
            else{
                $scope.model.selectedMenu = menu;
                if( $scope.model.selectedNDP && $scope.model.selectedNDP.code ){
                    $scope.model.selectedMenu.ndp = $scope.model.selectedNDP.code;
                }
            }
            SelectedMenuService.setSelectedMenu($scope.model.selectedMenu);
            $scope.$broadcast('MENU', $scope.model.selectedMenu);
        }
    };

    $scope.setBottomMenu = function(menu){
        if( $scope.model.selectedMenu && $scope.model.selectedMenu.domain === menu){
            $scope.model.selectedMenu = null;
        }
        else{
            $scope.model.selectedMenu = {domain: menu, view: $scope.model.bottomMenu[menu]};
        }
    };

    $scope.goToMenu = function( menuLink ){
        window.location.href = menuLink;
    };

    $scope.getMenuStyle = function( menu ){
        var style = menu.class + ' horizontal-menu font-16';
        if( menu.active ){
            style += ' active-horizontal-menu';
        }
        return style;
    };

    $scope.getTreeMenuStyle = function( menuItem ){
        var style = "";
        if ( menuItem ){
            if ( menuItem.id !== 'SPACE' ){
                style += 'active-menu-item';
            }
        }

        return style;
    };

    $scope.settings = function(){

        var modalInstance = $modal.open({
            templateUrl: 'components/settings/settings-modal.html',
            controller: 'SettingsController'
        });

        modalInstance.result.then(function () {

        });
    };

});
